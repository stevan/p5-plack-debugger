package Plack::App::Debugger;

use strict;
use warnings;

use Scalar::Util qw[ blessed ];
use parent 'Plack::Component';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    die "You must pass a reference to a 'Plack::Debugger' instance"
        unless blessed $args{'debugger'} 
            && $args{'debugger'}->isa('Plack::Debugger');

    $class->SUPER::new( %args );
}

sub prepare_app {}
# accessors ...

sub debugger { (shift)->{'debugger'} } # a reference to the Plack::Debugger

sub call {
    my ($self, $env) = @_;

    return [ 500, [], [] ]; # stub
}

1;

__END__