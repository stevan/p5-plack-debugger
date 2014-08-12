package Plack::Debugger::Panel;

use strict;
use warnings;

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

    bless {
        'title'    => $args{'title'}    || ((split /\:\:/ => $class)[-1]),
        'subtitle' => $args{'subtitle'} || '',
        'before'   => $args{'before'},
        'after'    => $args{'after'},
        'cleanup'  => $args{'cleanup'},
        # private data ...
        '_result'  => undef,
        '_context' => undef
    } => $class;
}

sub stash {
    my $self = shift;
    $self->{'_context'} = shift if @_;
    $self->{'_context'};
}

sub result {
    my $self = shift;
    $self->{'_result'} = shift if @_;
    $self->{'_result'};
}

1;

__END__