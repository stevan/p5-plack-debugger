package Plack::Debugger::Panel;

use strict;
use warnings;

use Scalar::Util qw[ refaddr ];

sub new {
    my $class = shift;
    my %args  = @_;

    foreach my $phase (qw( before after cleanup )) {
        if (defined $args{$phase}) {
            die "The '$phase' argument must be a CODE ref, not a " . ref($args{$phase}) . " ref"
                unless ref $args{$phase} 
                    && ref $args{$phase} eq 'CODE'; 
        }
    }

    my $self = bless {
        title    => $args{'title'},
        subtitle => $args{'subtitle'} || '',
        before   => $args{'before'},
        after    => $args{'after'},
        cleanup  => $args{'cleanup'},
        # private data ...
        _result  => undef,
        _stash   => undef
    } => $class;

    # ... title if one is not provided
    $self->{'title'} = (split /\:\:/ => $class)[-1] . '<' . refaddr($self) . '>'
        unless defined $self->{'title'};

    $self;
}

# accessors 

sub title    { (shift)->{'title'}    } # the main title to display for this debug panel (optional, but recommended)
sub subtitle { (shift)->{'subtitle'} } # the sub-title to display for this debug panel (optional)   
sub before   { (shift)->{'before'}   } # code ref to be run before the request   - args: ($self, $env)
sub after    { (shift)->{'after'}    } # code ref to be run after the request    - args: ($self, $env, $response)
sub cleanup  { (shift)->{'cleanup'}  } # code ref to be run in the cleanup phase - args: ($self, $env, $response)    

# some useful predicates ...

sub has_before   { !! (shift)->before  }
sub has_after    { !! (shift)->after   }
sub has_cleanup  { !! (shift)->cleanup }

# stash ...

sub stash {
    my $self = shift;
    $self->{'_stash'} = shift if @_;
    $self->{'_stash'};
}

# final result ...

sub get_result { (shift)->{'_result'} }
sub set_result {
    my $self    = shift;
    my $results = shift || die 'You must provide a results';
    
    $self->{'_result'} = $results;
}

# reset ...

sub reset {
    my $self = shift;
    undef $self->{'_stash'};
    undef $self->{'_result'};
}

1;

__END__