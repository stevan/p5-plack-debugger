package Plack::Debugger::Panel;

use strict;
use warnings;

use Scalar::Util qw[ refaddr ];

use Plack::Util::Accessor (
    'title',    # the main title to display for this debug panel
    'subtitle', # the sub-title to display for this debug panel    
    'before',   # code ref to be run before the request   - args: ($self, $env)
    'after',    # code ref to be run after the request    - args: ($self, $env, $response)
    'cleanup',  # code ref to be run in the cleanup phase - args: ($self, $env, $response)    
);

sub new {
    my $class = shift;
    my %args  = @_;

    foreach my $phase (qw( before after cleanup )) {
        if (exists $args{$phase}) {
            die "The '$phase' argument must be a CODE ref, not a " . ref($args{$phase}) . " ref"
                if ref($args{$phase}) ne 'CODE'; 
        }
    }

    my $self = bless {
        'title'    => $args{'title'},
        'subtitle' => $args{'subtitle'} || '',
        'before'   => $args{'before'},
        'after'    => $args{'after'},
        'cleanup'  => $args{'cleanup'},
        # private data ...
        '_result'  => undef,
        '_stash'   => undef
    } => $class;

    $self->{'title'} = (split /\:\:/ => $class)[-1] . '<' . refaddr($self) . '>'
        unless defined $self->{'title'};

    $self;
}

# some useful predicates ...
sub has_before   { !! (shift)->{'before'}   }
sub has_after    { !! (shift)->{'after'}    }
sub has_cleanup  { !! (shift)->{'cleanup'}  }

# stash ...

sub stash {
    my $self = shift;
    $self->{'_stash'} = shift if @_;
    $self->{'_stash'};
}

# final result ...

sub get_result { (shift)->{'_result'} }
sub set_result {
    my $self   = shift;
    my $result = shift || die 'You must provide a result';
    
    $self->{'_result'} = $result;
}

# reset ...

sub reset {
    my $self = shift;
    undef $self->{'_stash'};
    undef $self->{'_result'};
}

1;

__END__